const http = require('../src/utils/http');

describe('utils/http', () => {
    let res;
    beforeEach(() => {
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            sendStatus: jest.fn().mockReturnThis(),
        };
    });

    test('sendOk sends 200 and data', () => {
        const data = { ok: true };
        http.sendOk(res, data);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(data);
    });

    test('sendCreated sends 201 and data', () => {
        const data = { id: 1 };
        http.sendCreated(res, data);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(data);
    });

    test('sendNoContent sends 204', () => {
        http.sendNoContent(res);
        expect(res.sendStatus).toHaveBeenCalledWith(204);
    });

    test('sendBadRequest sends 400 and error structure', () => {
        http.sendBadRequest(res, 'Bad input');
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Bad input' });
    });

    test('sendUnauthorized sends 401', () => {
        http.sendUnauthorized(res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: expect.any(String) }));
    });

    test('sendError allows custom status', () => {
        http.sendError(res, 418, 'Teapot');
        expect(res.status).toHaveBeenCalledWith(418);
        expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Teapot' });
    });

});