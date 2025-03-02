"""Lambda Authorisation at Edge
"""

import os
from urllib.parse import quote_plus
import logging
import json

import boto3

logger = logging.getLogger(__name__)
logger.setLevel("DEBUG")  # set during development for full logging


def handler_function(event: dict, _) -> dict:
    """Lambda entry point to verify user is signed in, or redirect to sign in page

    Args:
        event (dict): AWS-Generated Event
        _ (any): AWS-Generated Context (unused in this function)

    Returns:
        dict: HTTP Response
    """
    logger.info("Request recieved")
    logger.debug(event)
    response = check_sign_in(event["Records"][0]["cf"]["request"])

    logger.debug("Response: %s", json.dumps(response))

    logger.info("Processing complete")

    return response


def get_parameters() -> dict:
    """Get Stored values from SSM Parameter Store

    Returns:
        dict: parameter_key: value
    """
    logger.debug("Getting Parameters")

    ssm_client = boto3.client("ssm", region_name="us-east-1")
    response = ssm_client.get_parameters(
        Names=[
            "domain-name",
            "user-pool-id",
            "user-pool-client-id",
            "cognito-endpoint",
        ]
    )

    logger.debug(response)

    return {param["Name"]: param["Value"] for param in response["Parameters"]}


def check_sign_in(request: dict) -> dict:
    """Verify user is signed in and return appropriate response

    If user is signed in, allow to proceed to the requested URL, otherwise redirect to sign in

    Args:
        request (dict): request dict

    Returns:
        dict: HTTP request - either the original request (signed in) or a redirect (not signed in)
    """
    logger.info("Checking sign in")
    logger.debug(request)
    headers = request["headers"]

    # Check for session-id in cookie or code in queries, if present, then proceed with request
    cookies = parse_cookies_from_header(headers)
    queries = kvp_split(request["querystring"].split("&"))
    if "session-id" in cookies:
        # already authenticated - return initial request
        logger.debug("Session ID found: %s", cookies["session-id"])
        return request
    if "code" in queries:
        # already authenticated - return initial request
        logger.debug("Code found: %s", queries["code"])
        return request

    # get store parameters
    parameters = get_parameters()
    logger.debug(parameters)

    # create sign in URL with requested URL encoded in the querystring
    signin_url = create_signin_url(parameters, request)
    logger.debug("Sign in URL generated: %s", signin_url)

    # return redirect response
    return {
        "headers": {
            "location": [
                {
                    "key": "Location",
                    "value": signin_url,
                }
            ]
        },
        "status": "302",
    }


def kvp_split(tokens: list, delimiter: str = "=") -> list:
    # nested comprehension to give cookies as a dictionary
    # the inner comprehension returns a list of key-value lists
    # the outer comprehension returns a dictionary with leading and trailing whitespace removed
    split_tokens = {
        kvp[0].strip(): kvp[1].strip()
        for kvp in [token.split(delimiter) for token in tokens if token]
    }
    return split_tokens


def parse_cookies_from_header(headers: dict) -> dict:
    """Parse cookies from header

    Args:
        headers (dict): HTTP headers passed to lambda function

    Returns:
        dict: cookies as key-value pairs
    """
    if "cookie" in headers:
        # get all cookies as a list from the string
        cookies_split = headers["cookie"][0]["value"].split(";")

        # get cookies as dictionary
        cookies = kvp_split(cookies_split)
        return cookies

    # default return value (empty dict)
    return {}


def create_signin_url(params: dict, request: dict) -> str:
    logger.info("Creating sign in URL")

    # elements of original URL to encode
    host = request["headers"]["host"][0]["value"]
    uri = request["uri"]
    querystring = request["querystring"]
    original_url = f"https://{host}{uri}"
    if querystring:
        original_url += f"?{querystring}"

    # if request is already an authorisation request, return
    if host.startswith("auth."):
        logger.info("already an authorisation url")
        return original_url

    # encode the original request url to pass as query parameter in sign in request
    original_url_encoded = quote_plus(original_url.encode("utf-8"))

    return f"https://auth.{params['domain-name']}/login?client_id={params['user-pool-client-id']}&redirect_uri={original_url_encoded}&response_type=code&scope=aws.cognito.signin.user.admin+email+openid+phone+profile"
