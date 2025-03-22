import json
import os
import logging
import boto3
from boto3.dynamodb.conditions import Key, Attr

logger = logging.getLogger(__name__)


def handler_function(event, _):
    logger.debug(event)
    logger.debug(os.environ)
    table_name = os.environ("DYNAMODB_TABLE")
    http_method = event["requestContext"]["http"]["method"]

    if http_method == "GET":
        search_params = event["queryStringParameters"]
    else:
        search_params = json.loads(event["body"])
    logger.debug(search_params)

    ddb_resource = boto3.resource("dynamodb")
    table = ddb_resource.Table(table_name)

    kw_args = {}

    if "new" in search_params:
        kw_args["FilterExpression"] = Attr("clipStatus").eq("NEW")

    response = table.scan(**kw_args)

    logger.debug(response)
