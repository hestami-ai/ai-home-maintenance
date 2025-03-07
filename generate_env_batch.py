import os
from dotenv import load_dotenv
import argparse

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Load environment variables from a .env file.")
    parser.add_argument('-f', '--file', type=str, default='.env', help='Path to the .env file (default: .env)')
    args = parser.parse_args()

    # Load environment variables from the specified file
    load_dotenv(args.file)

    # Create a batch file to set environment variables
    with open('set_env_vars.bat', 'w') as batch_file:
        for key, value in os.environ.items():
            batch_file.write(f'set "{key}={value}"\n')

if __name__ == "__main__":
    main()
