FROM public.ecr.aws/lambda/nodejs:20

# Force sharp to install the prebuilt binaries for linux arm64
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_arch=arm64
ENV npm_config_platform=linux

COPY package*.json ./

RUN npm install

COPY . .

# Lambda runs the function as a user that does NOT own the image files, and
# `@babel/register` reads the raw `src/**/*.js` sources at runtime. A source
# file that arrives with 0600 permissions is therefore unreadable at cold
# start and the whole function dies with `EACCES ... open '/var/task/src/...'`.
# Git only tracks the executable bit, so a bad mode is invisible in review and
# survives commits; this normalises the copy so one bad mode cannot break the
# deploy. See docs/incidents/2026-10-06-apps-eacces/README.md.
RUN chmod -R a+rX /var/task

# Command points to the Lambda handler
CMD ["src/index.handler"]
