import json
import os
import logging
import boto3
from boto3.dynamodb.conditions import Key, Attr

logger = logging.getLogger(__name__)


def handler_function(event, _):
    logger.debug(event)
    logger.debug(os.environ)
    table_name = os.environ["DYNAMODB_TABLE"]
    http_method = event["requestContext"]["httpMethod"]

    if http_method == "GET":
        logger.debug("GET method")
        search_params = event["queryStringParameters"]
        if search_params is None:
            search_params = {}
    else:
        logger.debug("Other method")
        search_params = json.loads(event["body"])
    logger.debug("Search params: %s", search_params)

    ddb_resource = boto3.resource("dynamodb")
    table = ddb_resource.Table(table_name)

    kw_args = {}

    if "new" in search_params:
        kw_args["FilterExpression"] = Attr("clipStatus").eq("NEW")

    response = table.scan(**kw_args)

    api_response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": True,
        },
        "body": json.dumps(response["Items"]),
    }

    logger.debug("Response: %s", api_response)

    return api_response
