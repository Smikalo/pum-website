import os
import re
import json
import shutil
import requests
import subprocess
import sys
from datetime import datetime

# --- Configuration ---
SOURCE_DIR = os.path.join("web", "public", "album")
PROCESSED_DIR = os.path.join(SOURCE_DIR, "processed")
THUMB_DIR = os.path.join(PROCESSED_DIR, "thumbnails")
CACHE_FILE = os.path.join(SOURCE_DIR, "upload_cache.json")
OUTPUT_JSON = os.path.join(SOURCE_DIR, "media_map.json")

# URL for free file hosting (Catbox.moe)
UPLOAD_URL = "https://catbox.moe/user/api.php"
MAX_SIZE_BYTES = 200 * 1024 * 1024  # 200MB limit

os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

# Regex Patterns
PATTERNS = [
    re.compile(r"video_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})"),
    re.compile(r"PXL_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})"),
    re.compile(r"photo_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})"),
    re.compile(r"photo_\d+_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})"),
]


def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


def extract_datetime(filename):
    for pattern in PATTERNS:
        match = pattern.search(filename)
        if match:
            try:
                parts = [int(p) for p in match.groups()[:6]]
                return datetime(*parts)
            except ValueError:
                continue
    return None


def generate_thumbnail(video_path, thumb_path):
    try:
        if os.path.exists(thumb_path):
            return True
        # Extract frame at 00:00:01
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-ss", "00:00:01.000", "-vframes", "1",
            thumb_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def compress_video(input_path, output_path):
    """
    Compresses video to 720p with CRF 28 to reduce size below 200MB.
    Returns True if successful.
    """
    print(f"    ...Compressing video to fit upload limit (this takes CPU power)...")
    try:
        # Scale to 720p height (width auto), CRF 28 (lower quality/size), preset fast
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vf", "scale=-2:720",
            "-c:v", "libx264", "-crf", "28", "-preset", "fast",
            "-c:a", "aac", "-b:a", "128k",
            output_path
        ]
        # Allow stderr to show progress/errors if needed, or mute it
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        new_size = os.path.getsize(output_path)
        print(f"    ...Compression done. New size: {new_size / (1024 * 1024):.1f} MB")
        return True
    except subprocess.CalledProcessError:
        print("    !!! Compression failed. FFMPEG error.")
        if os.path.exists(output_path):
            os.remove(output_path)
        return False
    except FileNotFoundError:
        print("    !!! FFMPEG not found. Cannot compress.")
        return False


def upload_file_catbox(file_path):
    try:
        with open(file_path, "rb") as f:
            response = requests.post(
                UPLOAD_URL,
                data={"reqtype": "fileupload", "userhash": ""},
                files={"fileToUpload": f}
            )

        if response.status_code == 200:
            return response.text.strip()
        else:
            print(f"    !! Upload failed: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"    !! Upload error: {e}")
        return None


def process_upload(file_path):
    file_size = os.path.getsize(file_path)
    print(f"  >> Processing {os.path.basename(file_path)} ({file_size / (1024 * 1024):.1f} MB)...")

    # If file is too big, compress to a temp file
    upload_path = file_path
    is_temp = False

    if file_size > MAX_SIZE_BYTES:
        print(f"    !! File too large (>200MB). Attempting compression...")
        temp_compressed = file_path + ".compressed.mp4"
        if compress_video(file_path, temp_compressed):
            upload_path = temp_compressed
            is_temp = True
            # Check if compression was enough
            if os.path.getsize(upload_path) > MAX_SIZE_BYTES:
                print("    !! Still too large after compression. Skipping upload.")
                os.remove(upload_path)
                return None
        else:
            print("    !! Skipping upload (Too large & compression failed).")
            return None

    # Perform Upload
    url = upload_file_catbox(upload_path)

    # Cleanup temp file
    if is_temp and os.path.exists(upload_path):
        os.remove(upload_path)

    return url


def main():
    upload_cache = load_cache()
    media_list = []

    print(f"Scanning {SOURCE_DIR}...")

    # 1. Move new files to processed
    for filename in os.listdir(SOURCE_DIR):
        file_path = os.path.join(SOURCE_DIR, filename)

        if not os.path.isfile(file_path) or filename.startswith("."): continue
        if filename in ["media_map.json", "events.json", "upload_cache.json"]: continue

        dt = extract_datetime(filename)
        if dt:
            dest_path = os.path.join(PROCESSED_DIR, filename)
            if not os.path.exists(dest_path):
                shutil.move(file_path, dest_path)
                print(f"Moved: {filename}")

    # 2. Iterate processed files
    processed_files = os.listdir(PROCESSED_DIR)
    total_files = len(processed_files)

    print(f"Processing {total_files} files...")

    for i, filename in enumerate(processed_files):
        file_path = os.path.join(PROCESSED_DIR, filename)
        if not os.path.isfile(file_path): continue
        if filename.startswith('.'): continue
        if filename == "thumbnails": continue

        dt = extract_datetime(filename)
        if not dt: continue

        ext = os.path.splitext(filename)[1].lower()
        is_video = ext in ['.mp4', '.mov', '.webm', '.mkv']
        media_type = "video" if is_video else "image"

        entry = {
            "date": dt.strftime("%Y-%m-%d"),
            "time": dt.strftime("%H:%M:%S"),
            "datetime": dt.isoformat(),
            "type": media_type,
            "year": dt.year,
            "filename": filename
        }

        if is_video:
            # Thumbnail Generation
            thumb_name = f"{os.path.splitext(filename)[0]}.jpg"
            thumb_rel_path = f"/album/processed/thumbnails/{thumb_name}"
            thumb_abs_path = os.path.join(THUMB_DIR, thumb_name)

            has_thumb = generate_thumbnail(file_path, thumb_abs_path)
            entry[
                "src"] = thumb_rel_path if has_thumb else "https://images.unsplash.com/photo-1536240478700-b869070f9279?q=80&w=800&auto=format&fit=crop"

            # Upload Handling
            if filename in upload_cache:
                entry["videoUrl"] = upload_cache[filename]
            else:
                print(f"[{i + 1}/{total_files}] New video found: {filename}")
                url = process_upload(file_path)
                if url:
                    upload_cache[filename] = url
                    save_cache(upload_cache)
                    entry["videoUrl"] = url
                    print(f"    -> Upload Success: {url}")
                else:
                    print("    -> Upload Failed. Using local fallback (will buffer).")
                    entry["videoUrl"] = f"/album/processed/{filename}"
                sys.stdout.flush()

        else:
            entry["src"] = f"/album/processed/{filename}"

        media_list.append(entry)

    media_list.sort(key=lambda x: x["datetime"])

    with open(OUTPUT_JSON, "w") as f:
        json.dump(media_list, f, indent=2)

    print(f"\nDone! Map updated at {OUTPUT_JSON}")


if __name__ == "__main__":
    main()