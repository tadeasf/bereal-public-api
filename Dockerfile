FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy application source
COPY . .

# Build the application
RUN bun run build

# Expose port
EXPOSE 3299

# Start the application
CMD ["bun", "start"]