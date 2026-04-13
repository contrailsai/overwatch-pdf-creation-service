FROM public.ecr.aws/lambda/nodejs:20

# Force sharp to install the prebuilt binaries for linux arm64
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_arch=arm64
ENV npm_config_platform=linux

COPY package*.json ./

RUN npm install

COPY . .

# Command points to the Lambda handler
CMD ["src/index.handler"]
