from flask import jsonify
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    def __init__(self, status: int, message: str, details=None):
        super().__init__(message)
        self.status, self.message, self.details = status, message, details


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _api(e: ApiError):
        body = {"error": e.message}
        if e.details:
            body["details"] = e.details
        return jsonify(body), e.status

    @app.errorhandler(HTTPException)
    def _http(e: HTTPException):
        return jsonify({"error": e.description or e.name}), e.code

    @app.errorhandler(Exception)
    def _unhandled(e: Exception):
        app.logger.exception(e)
        return jsonify({"error": "Internal server error"}), 500
