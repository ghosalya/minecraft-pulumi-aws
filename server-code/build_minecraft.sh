docker container rm mc
docker pull itzg/minecraft-server

docker run -d -it \
    -e EULA=TRUE \
    -e MEMORY=2G \
    -e VERSION=LATEST \
    -v ~/data:/data \
    -p 25565:25565 \
    --name mc itzg/minecraft-server