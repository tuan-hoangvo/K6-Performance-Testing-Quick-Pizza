pipeline {
    agent any 

    stages {
        stage('k6') {
            agent {
                docker { 
                    image 'grafana/k6'
                    args '--entrypoint=""'
                }
            }
            steps {
                sh 'k6 run quickPizzaTestScript.js --quiet'
            }
        }
    }
}