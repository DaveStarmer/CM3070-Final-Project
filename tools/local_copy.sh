SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
scp $SCRIPT_DIR/../local/* user@rpi.local:/home/user/app
