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
    ssm_client = boto3.client("ssm", region_name="us-east-1")
    response = ssm_client.get_parameters(
        Names=[
            "domin-name",
            "user-pool-id",
            "user-pool-client-id",
            "cognito-endpoint",
        ]
    )

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

    # Check for session-id in cookie, if present, then proceed with request
    cookies = parse_cookies_from_header(headers)
    if cookies and "session-id" in cookies:
        # already authenticated - return initial request
        logger.debug("Session ID found: %s", cookies["session-id"])
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

        # nested comprehension to give cookies as a dictionary
        # the inner comprehension returns a list of key-value lists
        # the outer comprehension returns a dictionary with leading and trailing whitespace removed
        cookies = {
            kvp[0].strip(): kvp[1].strip()
            for kvp in [cookie.split("=") for cookie in cookies_split if cookie]
        }
        return cookies

    # default return value (empty dict)
    return {}


def create_signin_url(params: dict, request: dict) -> str:
    logger.info("Creating sign in URL")

    # elements of original URL to encode
    host = request["headers"]["host"][0]["value"]
    uri = request["uri"]
    querystring = request["querystring"]
    original_url = f"https://{host}{uri}?{querystring}"

    # if request is already an authorisation request, return
    if host.startswith("auth."):
        logger.info("already an authorisation url")
        return original_url

    # encode the original request url to pass as query parameter in sign in request
    original_url_encoded = quote_plus(original_url.encode("utf-8"))

    return f"https://auth.{params['domain-name']}/login/?client_id={params['client-id']}redirect_url={original_url_encoded}"


def old_create_signin_url(request: dict) -> str:
    """Create signin URL with originally requested URL in querystring

    Args:
        request (dict): original request

    Returns:
        str: return URL
    """
    logger.info("Creating sign in URL")
    # elements of original URL to encode
    host = request["headers"]["host"][0]["value"]
    uri = request["uri"]
    querystring = request["querystring"]
    original_url = f"https://{host}{uri}?{querystring}"

    logger.debug("Request Host: %s   URI: %s   QueryString: %s", host, uri, querystring)

    custom_headers = request.get("origin", {}).get("s3", {}).get("customHeaders", {})
    logger.debug("Client Secret: %s", custom_headers.get("loginSecret"))

    if host.startswith("auth."):
        return original_url

    # encode the original request url to pass as query parameter in sign in request
    original_url_encoded = quote_plus(original_url.encode("utf-8"))

    # remove 'www' from start of host name if present
    root_host = host.replace("www.", "", 1) if host.startswith("www.") else host

    logger.debug("Root Host: %s", root_host)

    # return url to redirect to including the encoded original destination
    return f"https://auth.{root_host}/?redirect_url={original_url_encoded}"
