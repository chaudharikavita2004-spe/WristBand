import re
from .errors import ApiError

PHONE_RE = re.compile(r"^\+?[0-9 ()-]{7,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def require_json(request) -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "Request body must be a JSON object")
    return data


def validate(data: dict, schema: dict, partial: bool = False) -> dict:
    """schema: field -> (type, required, extra) where extra may hold max/min/choices/pattern."""
    out, errors = {}, {}
    for field, (typ, required, extra) in schema.items():
        if field not in data or data[field] in (None, ""):
            if required and not partial:
                errors[field] = "required"
            continue
        v = data[field]
        if typ is float and isinstance(v, int) and not isinstance(v, bool):
            v = float(v)
        if not isinstance(v, typ) or (typ is int and isinstance(v, bool)):
            errors[field] = f"must be {typ.__name__}"
            continue
        if isinstance(v, str):
            v = v.strip()
            if len(v) > extra.get("max", 500):
                errors[field] = "too long"; continue
        if "choices" in extra and v not in extra["choices"]:
            errors[field] = f"must be one of {extra['choices']}"; continue
        if "pattern" in extra and not extra["pattern"].match(v):
            errors[field] = "invalid format"; continue
        if "range" in extra and not (extra["range"][0] <= v <= extra["range"][1]):
            errors[field] = f"must be between {extra['range'][0]} and {extra['range'][1]}"; continue
        out[field] = v
    unknown = set(data) - set(schema)
    if unknown:
        errors.update({k: "unknown field" for k in unknown})
    if errors:
        raise ApiError(422, "Validation failed", errors)
    return out
