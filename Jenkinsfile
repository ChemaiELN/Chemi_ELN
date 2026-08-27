pipeline {
  agent any

  tools { nodejs 'node22' }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    // deploy.sh does its own independent checkout of origin/twofour into
    // /var/www/Chemi_ELN — this pipeline's own workspace checkout (below)
    // is used ONLY to run the CI gates before we trust that deploy.
    DEPLOY_SCRIPT = '/var/www/Chemi_ELN/deploy.sh'
  }

  stages {

    stage('Install') {
      parallel {
        stage('Backend deps') {
          steps { dir('backend-node') { sh 'npm ci' } }
        }
        stage('Frontend deps') {
          steps { dir('frontend') { sh 'npm ci' } }
        }
      }
    }

    stage('Verify') {
      parallel {
        stage('Backend typecheck + lint + test') {
          steps {
            dir('backend-node') {
              sh 'npm run typecheck'
              sh 'npm run lint'
              sh 'npm test'
            }
          }
        }
        stage('Frontend build + lint') {
          steps {
            dir('frontend') {
              sh 'npm run build'   // tsc -b && vite build — the strict gate
              sh 'npm run lint'
            }
          }
        }
      }
    }

    stage('Deploy') {
      when { branch 'twofour' }
      steps {
        // deploy.sh itself pulls origin/twofour fresh, rebuilds both apps,
        // runs any new migrations, reloads PM2 with zero downtime, reloads
        // nginx, and smoke-tests /api/health — see backend-node/DEPLOY.md
        // for the manual version of these same steps.
        sh 'sudo -n $DEPLOY_SCRIPT'
      }
    }
  }

  post {
    success {
      echo 'Pipeline succeeded.'
    }
    failure {
      echo 'Pipeline failed — if this happened during Verify, nothing was deployed. If it happened during Deploy, deploy.sh runs with `set -euo pipefail` and stops at the first failing step; check which step failed in the console output above before assuming production is broken.'
    }
  }
}
