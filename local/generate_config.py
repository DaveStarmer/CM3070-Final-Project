import json
from pathlib import Path

WORKING_FOLDER = Path(__file__).parent


def read_existing() -> dict:
    """Read existing config (if exists)

    Returns:
        dict: existing configuration
    """
    config_file = WORKING_FOLDER.joinpath("config.json")
    if config_file.exists():
        with config_file.open() as f:
            config = json.load(f)
    else:
        config = {}

    return config


def update_config_item(message, old_value=""):
    if old_value != "" and old_value is not None:
        message += f" (leave blank for {old_value})"
    message += ": "

    new_value = input(message)

    if new_value == "":
        return old_value
    return new_value


def update_config(config):
    camera_loop = True
    while camera_loop:
        cam_id = update_config_item("Camera ID")
        cam_name = update_config_item("Camera Name")
        cam_name = cam_name.replace(" ", "_")
        config["cameras"][cam_id] = cam_name
        repeat = input("Add another (Y/N)?")
        if repeat.upper() not in ["Y", "YES"]:
            camera_loop = False
    config["aws"]["accessKey"] = update_config_item(
        "AWS Access Key", config["aws"]["accessKey"]
    )
    config["aws"]["secretAccessKey"] = update_config_item(
        "AWS Secret Access Key", config["aws"]["secretAccessKey"]
    )
    config["aws"]["bucket"] = update_config_item(
        "AWS Bucket Name", config["aws"]["bucket"]
    )

    return config


def write_config(config):
    config_file = WORKING_FOLDER.joinpath("config.json")
    with config_file.open("w") as f:
        json.dump(config, f)


def main():
    config = read_existing()
    config = update_config(config)
    write_config(config)


if __name__ == "__main__":
    main()
