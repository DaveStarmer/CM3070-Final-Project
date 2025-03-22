"""Lambda Authorisation at Edge"""

import base64
from urllib.parse import quote_plus
import logging
import json
import requests
import boto3

from head_parse import kvp_split, parse_cookies_from_header

logger = logging.getLogger(__name__)


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
            "user-pool-client-secret",
            "cognito-endpoint",
        ]
    )

    logger.debug(response)

    return {param["Name"]: param["Value"] for param in response["Parameters"]}


def code_to_jwt(param: dict, code: str):
    """convert code to JWT

    Args:
        param (dict): Required parameters
        code (str): Code issued

    Returns:
        _type_: _description_
    """
    client_id = param["user-pool-client-id"]
    client_secret = param["user-pool-client-secret"]
    user_pool = param("user-pool-id")

    payload = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "code": code,
    }

    # encode authorisation to include in header
    b64_encoded_auth = base64.b64encode(f"{client_id}:{client_secret}".encode("ascii"))
    encoded_auth = b64_encoded_auth.decode("ascii")
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {encoded_auth}",
    }

    user_pool_token_url = (
        f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool}/.well-known/jwks.json"
    )
    response = requests.post(user_pool_token_url, params=payload, headers=headers)

    return response.json()


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


def create_signin_url(params: dict, request: dict) -> str:
    """Create an appropriate sign-in URL

    Args:
        params (dict): parameters previously received from SSM Parameter Store
        request (dict): request object

    Returns:
        str: URL for the correct Cognito Domain, with the original URL as part of the querystring
    """
    logger.info("Creating sign in URL")

    # elements of original URL to encode
    host = request["headers"]["host"][0]["value"]
    uri = request["uri"]
    querystring = request["querystring"]
    original_url = f"https://{host}{uri}"
    if querystring:
        original_url += f"?{querystring}"

    # if the original host starts with ".auth" and has a redirect_url this is valid authentication
    # request but if there is no redirect url, redirect to 'www'
    if host.startswith("auth."):
        logger.info("already an authorisation url")
        if "redirect_url" in querystring:
            return original_url
        else:
            original_url = original_url.replace("auth.", "www.", 1)

    # encode the original request url to pass as query parameter in sign in request
    original_url_encoded = quote_plus(original_url.encode("utf-8"))

    return f"https://auth.{params['domain-name']}/login?client_id={params['user-pool-client-id']}&redirect_uri={original_url_encoded}&response_type=code&scope=aws.cognito.signin.user.admin+email+openid+phone+profile"
