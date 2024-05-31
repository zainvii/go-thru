# Use Ubuntu as the base image
FROM ubuntu:20.04

# Set environment variables to avoid user prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-dev \
    python3-pip \
    git \
    wget \
    libasound2-dev \
    libpulse-dev \
    libssl-dev \
    libffi-dev \
    swig \
    pkg-config \
    && apt-get clean

# Set the working directory
WORKDIR /root

# Clone the PJSIP repository
RUN git clone https://github.com/pjsip/pjproject.git

# Set the working directory to the cloned repository
WORKDIR /root/pjproject

# Configure and build PJSIP with -fPIC flag
RUN CFLAGS="-fPIC" CXXFLAGS="-fPIC" ./configure && make dep && make

# # Build and install the Python bindings
# WORKDIR /root/pjproject/pjsip-apps/src/python
# RUN python3 setup.py build_ext --inplace --force && python3 setup.py install

# Expose all ports to the host
EXPOSE 0-65535

# Set the entry point to the shell
ENTRYPOINT ["/bin/bash"]
