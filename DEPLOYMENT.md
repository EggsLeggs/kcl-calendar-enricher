# Deployment Guide

This guide covers deploying the KCL Calendar Enricher to production using Docker and Portainer.

## Prerequisites

- Docker and Docker Compose installed
- Portainer installed and configured
- Cloudflare account with access to Cloudflare Tunnel (Zero Trust)
- Access to GitHub Container Registry

## 1. Set Up Cloudflare Tunnel

1. Log in to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** → **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** as the tunnel type
5. Give your tunnel a name (e.g., `kcl-calendar-enricher`)
6. Copy the tunnel token - you'll need this for the next step
7. Configure the tunnel:
   - **Public Hostname**: Set your desired subdomain
   - **Service Type**: HTTP
   - **URL**: `app:8080` (this is the internal Docker network address)

## 2. Configure Environment Variables

1. Create a `.env` file in your deployment directory:

```bash
cp .env.example .env
```

2. Edit the `.env` file and add your Cloudflare tunnel token:

```env
CLOUDFLARE_TUNNEL_TOKEN=your-actual-tunnel-token-here
```

**Important**: Never commit the `.env` file to version control!

## 3. Deploy with Portainer

### Option A: Using Portainer Stacks (Recommended)

1. Log in to your Portainer instance
2. Navigate to **Stacks** → **Add stack**
3. Give your stack a name: `kcl-calendar-enricher`
4. Choose **Git Repository** or **Upload** method:

#### Git Repository Method:
- Repository URL: `https://github.com/eggsleggs/kcl-calendar-enricher`
- Repository reference: `refs/heads/main`
- Compose path: `docker-compose.yml`

5. Add environment variables:
   - Click **Add an environment variable**
   - Name: `CLOUDFLARE_TUNNEL_TOKEN`
   - Value: Your tunnel token from step 1

6. Click **Deploy the stack**

#### Upload Method:
1. Copy the contents of `docker-compose.yml`
2. Paste into the web editor
3. Add environment variables as above
4. Click **Deploy the stack**

### Option B: Using Docker Compose CLI

1. SSH into your server
2. Clone the repository or copy the `docker-compose.yml` file
3. Create the `.env` file with your tunnel token
4. Pull and start the services:

```bash
docker-compose pull
docker-compose up -d
```

## 4. Verify Deployment

1. Check container status:
```bash
docker-compose ps
```

Both `kcl-calendar-enricher-app` and `kcl-calendar-cloudflared` should be running.

2. Check logs:
```bash
docker-compose logs -f
```

3. Test the health endpoint:
```bash
curl https://your-tunnel-domain.com/health
```

You should receive `OK` as the response.

## 5. Monitoring

### View Logs in Portainer
1. Navigate to **Containers**
2. Click on the container name
3. Select **Logs** tab
4. Enable **Auto-refresh logs**

### View Logs via CLI
```bash
# All logs
docker-compose logs -f

# App logs only
docker-compose logs -f app

# Cloudflared logs only
docker-compose logs -f cloudflared
```

### Health Checks
The application includes built-in health checks:
- Endpoint: `GET /health`
- Returns: `OK` (HTTP 200)
- Check interval: Every 30 seconds
- Retries: 3 before marking unhealthy

## 6. Updating the Application

### Automatic Updates (via CI/CD)
When you push to the `main` branch, GitHub Actions will:
1. Run tests with coverage
2. Build a new Docker image
3. Push to GitHub Container Registry with tags `latest` and the commit SHA
4. Trigger Portainer webhook to automatically pull and redeploy the new image

**Note:** For automatic redeployment to work, you must configure the following GitHub secrets:
- `PORTAINER_WEBHOOK_URL` - Your Portainer stack webhook URL (found in Portainer stack settings)
- `CF_ACCESS_CLIENT_ID` - Cloudflare Zero Trust client ID
- `CF_ACCESS_CLIENT_SECRET` - Cloudflare Zero Trust client secret

The webhook URL and credentials are required to authenticate and trigger redeployment through Cloudflare Zero Trust protection.

### Manual Update in Portainer
1. Navigate to **Stacks** → Select your stack
2. Click **Pull and redeploy**
3. Confirm the action

### Manual Update via CLI
```bash
docker-compose pull
docker-compose up -d
```

## 7. Rollback

To rollback to a specific version:

```bash
# Find the commit SHA you want to rollback to
docker pull ghcr.io/eggsleggs/kcl-calendar-enricher:<commit-sha>

# Update docker-compose.yml to use the specific tag
# Then restart
docker-compose up -d
```

## 8. Troubleshooting

### Container won't start
```bash
# Check logs for errors
docker-compose logs app

# Verify environment variables
docker-compose config
```

### Cloudflare tunnel not connecting
```bash
# Check cloudflared logs
docker-compose logs cloudflared

# Verify tunnel token is correct
# Check Cloudflare Zero Trust dashboard for tunnel status
```

### Health check failing
```bash
# Test health endpoint internally
docker exec kcl-calendar-enricher-app wget -qO- http://localhost:8080/health

# Check app logs for errors
docker-compose logs app
```

## 9. Security Considerations

1. **Tunnel Token**: Keep your `CLOUDFLARE_TUNNEL_TOKEN` secure
2. **Network Isolation**: The app and cloudflared communicate via internal Docker network only
3. **No Direct Port Exposure**: Port 8080 is not exposed to the host in production
4. **HTTPS**: All traffic is encrypted via Cloudflare Tunnel
5. **Regular Updates**: Keep Docker images updated for security patches

## 10. Resource Requirements

Minimum recommended resources:
- **CPU**: 0.5 cores
- **Memory**: 512 MB (app) + 128 MB (cloudflared)
- **Disk**: 500 MB for images and logs

Current configuration:
- Java heap: 256-512 MB (via JAVA_OPTS)
- Log rotation: 10 MB max per file, 3 files retained

## Support

For issues or questions:
- Check logs first: `docker-compose logs -f`
- Review Cloudflare Zero Trust dashboard for tunnel status
- Verify environment variables are set correctly
- Check GitHub Actions for build failures
