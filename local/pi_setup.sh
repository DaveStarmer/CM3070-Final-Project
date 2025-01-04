USER_HOME="/home/$USER"

echo Installing requirements

sudo apt update
sudo apt install -y ffmpeg

python3 -m venv --system-site-packages ~/.venv
. ~/.venv/bin/activate
pip install --upgrade pip
pip install -r $USER_HOME/app/requirements.txt

LINE="source $USER_HOME/.venv/bin/activate"
BASHRC="$USER_HOME/.bashrc"

echo Adding load venv to .bashrc if required

if  ! grep -Fxq "$LINE" "$BASHRC" ; then
    printf "\n$LINE\n" >>  $BASHRC;
    echo Line Appended;
fi

echo Setup complete