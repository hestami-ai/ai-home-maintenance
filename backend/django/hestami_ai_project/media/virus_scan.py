import tempfile
import os
from typing import Tuple
from io import BytesIO
import socket as stdlib_socket
from gevent import monkey

# Get the original (non-patched) socket module before gevent patches it
# This ensures ClamAV communication uses blocking I/O, not gevent greenlets
_original_socket = stdlib_socket.socket if not monkey.is_module_patched('socket') else None

from clamav_client.clamd import ClamdNetworkSocket

class ClamAVScanner:
    """
    ClamAV scanner using clamav-client library.
    Uses blocking I/O to avoid gevent greenlet issues.
    """
    def __init__(self, host: str = 'clamav', port: int = 3310):
        self.host = host
        self.port = port
        
        # Temporarily unpatch socket for ClamAV connection
        # This prevents gevent from interfering with the socket communication
        if monkey.is_module_patched('socket'):
            # Save gevent-patched socket
            gevent_socket = stdlib_socket.socket
            # Restore original socket temporarily
            stdlib_socket.socket = monkey.get_original('socket', 'socket')
            try:
                self.client = ClamdNetworkSocket(host=host, port=port)
            finally:
                # Restore gevent socket
                stdlib_socket.socket = gevent_socket
        else:
            self.client = ClamdNetworkSocket(host=host, port=port)

    def scan_stream(self, file_obj) -> Tuple[bool, str]:
        """
        Scan a file-like object using ClamAV's INSTREAM command
        Uses custom implementation with larger buffer to avoid INSTREAM size limit errors
        Returns (is_clean, message)
        """
        print("Scanning stream with custom INSTREAM implementation...")
        import socket
        import struct
        
        sock = None
        try:
            # Reset file pointer to beginning
            try:
                file_obj.seek(0)
            except (AttributeError, IOError):
                pass
            
            # Create socket with original (non-gevent) socket if available
            print(f"Connecting to ClamAV at {self.host}:{self.port}...")
            if monkey.is_module_patched('socket'):
                original_socket = monkey.get_original('socket', 'socket')
                sock = original_socket(stdlib_socket.AF_INET, stdlib_socket.SOCK_STREAM)
            else:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            
            sock.settimeout(30)
            sock.connect((self.host, self.port))
            print("Connected to ClamAV")
            
            # Send INSTREAM command
            sock.sendall(b'zINSTREAM\0')
            print("INSTREAM command sent")
            
            # Send file data in large chunks (5MB) to avoid buffer issues
            chunk_size = 5 * 1024 * 1024  # 5MB chunks
            total_sent = 0
            
            while True:
                chunk = file_obj.read(chunk_size)
                if not chunk:
                    break
                
                # Send chunk size (4 bytes, network byte order) followed by chunk data
                size = struct.pack('!L', len(chunk))
                sock.sendall(size + chunk)
                total_sent += len(chunk)
                print(f"Sent {total_sent} bytes to ClamAV...")
            
            print(f"Total bytes sent: {total_sent}")
            
            # Send zero-length chunk to signal end of stream
            sock.sendall(struct.pack('!L', 0))
            print("End-of-stream marker sent")
            
            # Receive response
            response = sock.recv(4096)
            result = response.decode('utf-8', errors='ignore').strip()
            print(f"ClamAV response: {result}")
            
            # Parse response
            if 'OK' in result:
                print("File is clean")
                return True, "File is clean"
            elif 'FOUND' in result:
                print(f"Malware detected: {result}")
                return False, f"Malware detected: {result}"
            else:
                print(f"Unexpected response: {result}")
                return False, f"Unexpected scan response: {result}"
            
        except Exception as e:
            print(f"Error scanning file: {str(e)}")
            import traceback
            traceback.print_exc()
            return False, f"Error scanning file: {str(e)}"
        finally:
            if sock:
                try:
                    sock.close()
                    print("Socket closed")
                except:
                    pass

def scan_file(file) -> Tuple[bool, str]:
    """
    Scan a file using ClamAV
    Returns (is_clean, message)
    """
    print("Scanning file...")
    scanner = ClamAVScanner()
    
    # Reset file pointer to beginning
    try:
        file.seek(0)
    except (AttributeError, IOError):
        pass
    
    # The clamav-client library handles file-like objects directly
    # No need for temporary files
    print(f"File type: {type(file)}")
    return scanner.scan_stream(file)
