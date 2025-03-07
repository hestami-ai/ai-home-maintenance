import socket
import struct
import tempfile
import os
from typing import Tuple

class ClamAVScanner:
    """
    ClamAV scanner using direct socket communication.
    Based on the INSTREAM protocol: https://linux.die.net/man/8/clamd
    """
    def __init__(self, host: str = 'clamav', port: int = 3310):
        self.host = host
        self.port = port
        self.chunk_size = 2048  # Send file in 2KB chunks

    def _send_chunk(self, sock: socket.socket, chunk: bytes) -> None:
        """Send a chunk of data to ClamAV"""
        size = struct.pack('!L', len(chunk))
        sock.send(size + chunk)

    def _recv_response(self, sock: socket.socket) -> str:
        """
        Receive response from ClamAV daemon
        """
        response = sock.recv(4096).strip()
        print(f"Raw response: {response!r}")  # Debug: show raw response with repr()
        try:
            # Decode response from bytes to string, handle potential encoding issues
            return response.decode('utf-8').strip()
        except UnicodeDecodeError:
            # Fallback to ascii if utf-8 fails, ignore non-ascii characters
            return response.decode('ascii', errors='ignore').strip()

    def scan_stream(self, file_obj) -> Tuple[bool, str]:
        """
        Scan a file-like object using ClamAV's INSTREAM command
        Returns (is_clean, message)
        """

        print("Scanning stream...")
        try:
            # Connect to ClamAV
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((self.host, self.port))

            # Send INSTREAM command
            sock.send(b'zINSTREAM\0')

            while True:
                chunk = file_obj.read(self.chunk_size)
                if not chunk:
                    break
                self._send_chunk(sock, chunk)

            # Send zero length chunk to indicate end of stream
            sock.send(struct.pack('!L', 0))

            # Get response
            result = self._recv_response(sock)
            sock.close()

            print(f"Response type: {type(result)}")  # Debug: show response type
            print(f"Response value: {result!r}")     # Debug: show exact response value
            print(f"Response length: {len(result)}") # Debug: show response length
            
            # Compare with repr strings to see exact content
            if 'stream: OK' in result:
                print("File is clean")
                return True, "File is clean"
            elif 'FOUND' in result:
                print(f"Malware detected: '{result}'")
                return False, f"Malware detected: {result}"
            else:
                print(f"Unexpected response: '{result}'")
                return False, f"Unexpected response: {result}"

        except socket.error as e:
            print(f"ClamAV connection error: {str(e)}")
            return False, f"ClamAV connection error: {str(e)}"
        except Exception as e:
            print(f"Error scanning file: {str(e)}")
            return False, f"Error scanning file: {str(e)}"

def scan_file(file) -> Tuple[bool, str]:
    """
    Scan a file using ClamAV
    Returns (is_clean, message)
    """

    print ("Scanning file...")
    scanner = ClamAVScanner()
    
    # Create a temporary file if we got a Django uploaded file
    if hasattr(file, 'temporary_file_path'):
        # Django already has the file on disk
        with open(file.temporary_file_path(), 'rb') as f:
            return scanner.scan_stream(f)
    else:
        # We need to create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp.flush()
            
            try:
                with open(tmp.name, 'rb') as f:
                    return scanner.scan_stream(f)
            finally:
                os.unlink(tmp.name)  # Clean up the temporary file
