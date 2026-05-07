CREATION STEPS

# 1) Set your values
export AWS_ACCOUNT_ID="<aws-account-id>"
export AWS_REGION="<region>"
export ECR_REPOSITORY="<repository-name>"
export IMAGE_TAG="latest"
export LAMBDA_FUNCTION_NAME="<lambda-function-name>"

export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"

# 2) Build the image
docker build --platform linux/arm64 --provenance=false -t "$IMAGE_URI" .

# 3) Login to Amazon ECR (if push fails or auth is expired)
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# 4) Push image to Amazon ECR
docker push "$IMAGE_URI"

# 5) Update Lambda to use the new image
aws lambda update-function-code --function-name "$LAMBDA_FUNCTION_NAME" --image-uri "$IMAGE_URI"