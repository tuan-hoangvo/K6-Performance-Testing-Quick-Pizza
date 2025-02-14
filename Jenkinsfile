pipeline {
    agent any 

    stages {
        stage('k6') {
            steps {
                agent {
                    docker { 
                        image 'grafana/k6'
                        args '--entrypoint=""'
                    }
                }
                echo 'k6'
            }
        }
    }
}