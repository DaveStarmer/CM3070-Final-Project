"""Utilities for Edge Lambdas

these are symlinked across the necessary folders to avoid duplication"""


def kvp_split(tokens: list, delimiter: str = "=") -> dict:
    """Split list of key=value strings into dictionary of key:value

    Args:
        tokens (list): list of strings in key=value format
        delimiter (str, optional): delimiter between key and value. Defaults to "=".

    Returns:
        dict: key-value pair dictionary
    """
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
