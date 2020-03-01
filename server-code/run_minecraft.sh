trap ctrl_c INT

function ctrl_c() {
    echo Stopping Minecraft server..
    docker stop mc
    sh /opt/server-code/backup.sh
}

function start_server() {
    echo Starting Minecraft server..
    docker start mc
    docker logs -f mc
}

start_server