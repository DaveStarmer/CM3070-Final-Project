import logging
from head_parse import kvp_split

logger = logging.getLogger(__name__)


def handler_function(event: dict, _) -> dict:
    """Edge Authrisation Lambda - Viewer Response

    passes the correct code back as a cookie

    Args:
        event (dict): _description_
        _ (_type_): _description_

    Returns:
        dict: _description_
    """
    logger.info("Handling request")
    response = event["Records"][0]["cf"]["response"]
    request = event["Records"][0]["cf"]["request"]
    logger.debug(request)

    # create the set-cookie header if not present
    if "set-cookie" not in response["headers"]:
        response["headers"]["set-cookie"] = []

    headers = request["headers"]
    queries = kvp_split(request["querystring"].split("&"))

    if "code" not in queries:
        logger.info("no code issued")
        return response

    cookie_value = f"session-id={queries['code']};Max-Age=3600;Secure"
    logger.debug("Cookie: %s", cookie_value)

    response["headers"]["set-cookie"].append(
        {"key": "Set-Cookie", "value": cookie_value}
    )

    logger.debug(response)

    return response
