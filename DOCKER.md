# Docker image releases

The image is published to Docker Hub as `rebelor/mix-id:<version>`. It includes the CLI source from this repository, Node.js, FFmpeg, and yt-dlp.

## Configure GitHub Actions

Add these repository Actions secrets:

- `DOCKERHUB_USERNAME`: Docker Hub account that owns `rebelor/mix-id`.
- `DOCKERHUB_TOKEN`: Docker Hub access token with permission to push that repository.

## Release

Keep the Git tag aligned with the `version` in `package.json`. For version `1.1.0`, create and push tag `v1.1.0`:

```sh
git tag v1.1.0
git push origin v1.1.0
```

The tag workflow builds and pushes `rebelor/mix-id:1.1.0` for `linux/amd64` and `linux/arm64`.

## Local build

```sh
docker build -t rebelor/mix-id:1.1.0 .
docker run --rm rebelor/mix-id:1.1.0 --help
```
