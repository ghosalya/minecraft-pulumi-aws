function restore() {
    aws s3 cp s3://$MC_BUCKET/backup/latest.zip /opt/restore/latest.zip
    unzip /opt/restore/latest.zip -d /opt/data/world/
}

restore