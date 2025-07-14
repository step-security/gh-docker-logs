# Docker Container Logs Collection Action

[![GitHub Issues](https://img.shields.io/github/issues/step-security/gh-docker-logs)](https://github.com/step-security/gh-docker-logs/issues)
[![GitHub Stars](https://img.shields.io/github/stars/step-security/gh-docker-logs)](https://github.com/step-security/gh-docker-logs/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Automatically collect and manage logs from all running Docker containers in your GitHub Actions workflow.

## Features

- **Automatic Log Collection**: Gather logs from all running Docker containers
- **Flexible Output**: Stream to stdout or save to files for artifact upload
- **Selective Filtering**: Target specific containers by image name
- **Configurable Limits**: Control log volume with line count limits
- **Cross-Shell Support**: Works with different shell environments
- **Easy Integration**: Simple YAML configuration for any workflow

## Quick Start

Add this action to your workflow to automatically collect Docker logs on failure:

```yaml
- name: Collect Docker logs on failure
  if: failure()
  uses: step-security/gh-docker-logs@v2
```

## Configuration

### Input Parameters

| Parameter | Description | Default | Required |
|-----------|-------------|---------|----------|
| `dest` | Destination folder to write log files. If not provided, logs are written to stdout. Files are named by container (e.g., `redis.log`) | stdout | No |
| `images` | Comma-delimited list of image names to filter containers. Supports exact matches (`mongo:3.4.22`) or name-only matches (`mongo`) | all containers | No |
| `tail` | Maximum number of lines to collect from each container | `all` | No |
| `shell` | Shell to execute commands | `/bin/sh` | No |

### Output Behavior

- **stdout mode**: Logs are printed directly to the workflow output
- **file mode**: Individual log files are created for each container in the specified directory
- **filtering**: Only containers matching the specified images are processed
- **naming**: Log files use container names with `.log` extension

## Usage Examples

### Basic Usage - Collect All Logs on Failure

```yaml
  - name: Collect Docker logs on failure
    if: failure()
    uses: step-security/gh-docker-logs@v2
```

### Selective Log Collection

```yaml
- name: Collect specific service logs
  uses: step-security/gh-docker-logs@v2
  with:
    images: 'redis,mongo,postgres'
    tail: '100'
```

### Save Logs as Artifacts

```yaml
- name: Collect Docker logs to files
  if: failure()
  uses: step-security/gh-docker-logs@v2
  with:
    dest: './docker-logs'

- name: Archive logs
  if: failure()
  run: tar -czf docker-logs.tar.gz ./docker-logs

- name: Upload logs as artifact
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: docker-logs
    path: docker-logs.tar.gz
    retention-days: 7
```

### Custom Shell Environment

```yaml
- name: Collect logs with custom shell
  if: failure()
  uses: step-security/gh-docker-logs@v2
  with:
    shell: '/bin/bash'
```

## Best Practices

- **Use with `if: failure()`** to avoid unnecessary log collection on successful runs
- **Set appropriate `tail` limits** for large applications to prevent overwhelming output
- **Filter by specific images** when you only need logs from certain services
- **Upload logs as artifacts** for persistent access to debugging information
- **Consider log retention policies** when using artifact uploads

## Common Use Cases

- **CI/CD Debugging**: Capture logs when tests fail
- **Integration Testing**: Monitor service interactions
- **Performance Analysis**: Collect logs for performance troubleshooting
- **Security Auditing**: Preserve container output for security reviews

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [Report Issues](https://github.com/step-security/gh-docker-logs/issues)
- [View Documentation](https://github.com/step-security/gh-docker-logs)
- [Step Security](https://www.stepsecurity.io/)
