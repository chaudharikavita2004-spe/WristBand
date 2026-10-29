from flask import current_app, g


def repo():
    return current_app.extensions["repo"]


def ctx():
    return g.token, g.user["id"]
