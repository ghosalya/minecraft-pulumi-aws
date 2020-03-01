function backup_data() {
    echo Backing up world data..
    CURRENTDATETIME=`date +"%Y%m%d-%T"`
    /opt/backup/raw_${CURRENTDATETIME}
    cp /opt/data/world/* /opt/backup/raw_${CURRENTDATETIME}/ -rf
    zip /opt/backup/backup_${CURRENTDATETIME}.zip /opt/backup/raw_${CURRENTDATETIME}/* -r
    rm -rf /opt/backup/raw_${CURRENTDATETIME}
    echo Backup created as : backup_${CURRENTDATETIME}.zip

    # upload to bucket
    aws s3 cp /opt/backup/backup_${CURRENTDATETIME}.zip s3://$MC_BUCKET/backup/backup_${CURRENTDATETIME}.zip
    aws s3 cp /opt/backup/backup_${CURRENTDATETIME}.zip s3://$MC_BUCKET/backup/latest.zip
}

backup_data