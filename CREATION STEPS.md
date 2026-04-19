CREATION STEPS

# BUILD THE IMAGE
docker build --platform linux/arm64 --provenance=false -t 992382580458.dkr.ecr.ap-south-1.amazonaws.com/overwatch-pdf-creation:latest .

# LOGIN DOCKER WITH AWS IF PUSH DOESNT WORK..
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 992382580458.dkr.ecr.ap-south-1.amazonaws.com

# PUSH IT TO AWS
docker push 992382580458.dkr.ecr.ap-south-1.amazonaws.com/overwatch-pdf-creation:latest

# UPDATE THE FUNCTION IMAGE 
aws lambda update-function-code --function-name overwatch-report-generation --image-uri 992382580458.dkr.ecr.ap-south-1.amazonaws.com/overwatch-pdf-creation:latest