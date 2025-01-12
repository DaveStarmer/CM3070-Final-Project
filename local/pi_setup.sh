USER_HOME="/home/$USER"

echo Installing requirements

# install ffmpeg for adding metadata to videos
sudo apt update
sudo apt install -y ffmpeg

# create a virtual environment
python3 -m venv --system-site-packages ~/.venv
. ~/.venv/bin/activate

# update pip and install dependencies
pip install --upgrade pip
pip install -r $USER_HOME/app/requirements.txt

# function for adding lines to .bashrc
add_to_file() {
    if  ! grep -Fxq "$2" "$1" ; then
        printf "\n$2\n" >>  $1;
        echo Line Appended;
    fi
}

BASHRC="$USER_HOME/.bashrc"
RCLOCAL="/etc/rc.local"

add_to_file $BASHRC "source $USER_HOME/.venv/bin/activate"
add_to_file $RCLOCAL "python3 $USER_HOME/app/main.py"

echo Adding load venv to .bashrc if required

echo Setup complete