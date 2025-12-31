import os
import json

# Paths
ALBUM_DIR = os.path.join("web", "public", "album")
PROCESSED_DIR = os.path.join(ALBUM_DIR, "processed")
CACHE_FILE = os.path.join(ALBUM_DIR, "upload_cache.json")


def main():
    if not os.path.exists(CACHE_FILE):
        print("No upload cache found. Cannot safely delete files.")
        return

    with open(CACHE_FILE, "r") as f:
        uploaded_files = json.load(f)

    print(f"Found {len(uploaded_files)} uploaded videos in cache.")

    freed_bytes = 0
    deleted_count = 0

    # Check files in processed directory
    if os.path.exists(PROCESSED_DIR):
        for filename in os.listdir(PROCESSED_DIR):
            file_path = os.path.join(PROCESSED_DIR, filename)

            # Skip if it's a directory (like 'thumbnails')
            if os.path.isdir(file_path):
                continue

            # Only delete if it's in our upload record
            if filename in uploaded_files:
                try:
                    size = os.path.getsize(file_path)
                    os.remove(file_path)
                    freed_bytes += size
                    deleted_count += 1
                    print(f"Deleted local copy: {filename}")
                except OSError as e:
                    print(f"Error deleting {filename}: {e}")

    # Convert bytes to readable format
    gb = freed_bytes / (1024 * 1024 * 1024)
    mb = freed_bytes / (1024 * 1024)

    print("-" * 30)
    if gb >= 1:
        print(f"✅ Cleanup complete! Freed {gb:.2f} GB of disk space.")
    else:
        print(f"✅ Cleanup complete! Freed {mb:.2f} MB of disk space.")
    print(f"🗑️  Deleted {deleted_count} video files.")
    print("Photos and thumbnails were kept safe.")


if __name__ == "__main__":
    main()