#!/bin/bash

# LibreChat Production Deployment Script for Henly AI
# This script automates the deployment process

set -e

echo "🚀 Starting LibreChat Production Deployment for Henly AI"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker installation..."
    if ! docker --version > /dev/null 2>&1; then
        print_error "Docker is not installed or not running"
        exit 1
    fi
    if ! docker-compose --version > /dev/null 2>&1; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker and Docker Compose are available"
}

# Generate secure secrets
generate_secrets() {
    print_status "Generating secure secrets..."
    
    if [ ! -f .env ]; then
        print_status "Creating .env file from template..."
        cp env.production.template .env
    fi
    
    # Generate JWT secrets if not already set
    if grep -q "your-super-secret-jwt-key-here-change-this" .env; then
        JWT_SECRET=$(openssl rand -base64 32)
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        MEILI_MASTER_KEY=$(openssl rand -base64 32)
        
        # Update .env file with generated secrets
        sed -i.bak "s/your-super-secret-jwt-key-here-change-this/$JWT_SECRET/g" .env
        sed -i.bak "s/your-super-secret-refresh-key-here-change-this/$JWT_REFRESH_SECRET/g" .env
        sed -i.bak "s/your-meili-master-key-here-change-this/$MEILI_MASTER_KEY/g" .env
        
        print_success "Generated secure secrets"
    else
        print_warning "Secrets already configured in .env file"
    fi
}

# Create SSL directory and certificates
setup_ssl() {
    print_status "Setting up SSL certificates..."
    
    mkdir -p ssl
    
    if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
        print_status "Generating self-signed SSL certificates..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem \
            -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Henly AI/CN=localhost"
        print_success "Generated SSL certificates"
    else
        print_warning "SSL certificates already exist"
    fi
}

# Build and start services
deploy_services() {
    print_status "Building and starting LibreChat services..."
    
    # Stop any existing containers
    docker-compose -f deploy-compose.yml down 2>/dev/null || true
    
    # Build and start services
    docker-compose -f deploy-compose.yml up -d --build
    
    print_success "Services started successfully"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for MongoDB
    print_status "Waiting for MongoDB..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose -f deploy-compose.yml exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
            print_success "MongoDB is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "MongoDB failed to start within 60 seconds"
        exit 1
    fi
    
    # Wait for LibreChat API
    print_status "Waiting for LibreChat API..."
    timeout=120
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:3080/api/health > /dev/null 2>&1; then
            print_success "LibreChat API is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "LibreChat API failed to start within 120 seconds"
        exit 1
    fi
}

# Display deployment information
show_deployment_info() {
    echo ""
    echo "🎉 LibreChat Production Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "📋 Deployment Information:"
    echo "   • LibreChat API: https://localhost:3080"
    echo "   • Health Check: https://localhost:3080/api/health"
    echo "   • MongoDB: mongodb://localhost:27017"
    echo "   • Meilisearch: http://localhost:7700"
    echo ""
    echo "🔧 Next Steps:"
    echo "   1. Update your Henly AI configuration:"
    echo "      NEXT_PUBLIC_LIBRECHAT_URL=https://your-domain.com"
    echo "      LIBRECHAT_JWT_SECRET=<from .env file>"
    echo ""
    echo "   2. Configure your domain and SSL certificates"
    echo "   3. Set up monitoring and backups"
    echo "   4. Test the integration with Henly AI"
    echo ""
    echo "📚 Useful Commands:"
    echo "   • View logs: docker-compose -f deploy-compose.yml logs -f"
    echo "   • Stop services: docker-compose -f deploy-compose.yml down"
    echo "   • Restart services: docker-compose -f deploy-compose.yml restart"
    echo ""
}

# Main deployment process
main() {
    check_docker
    generate_secrets
    setup_ssl
    deploy_services
    wait_for_services
    show_deployment_info
}

# Run main function
main "$@" 