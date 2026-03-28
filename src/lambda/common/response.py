import json
from decimal import Decimal


class DecimalEncoder(json.JSONEncoder):
    """Handle DynamoDB Decimal types in JSON responses."""

    def default(self, o):
        if isinstance(o, Decimal):
            return int(o) if o == int(o) else float(o)
        return super().default(o)


def ok(body, status=200, cache=0):
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Api-Key",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    if cache > 0:
        headers["Cache-Control"] = f"public, max-age={cache}, stale-while-revalidate={cache}"
    else:
        headers["Cache-Control"] = "no-store"
    return {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def error(message, status=400):
    return ok({"error": message}, status)
