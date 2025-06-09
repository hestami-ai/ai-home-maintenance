from clamav_client.clamd import ClamdNetworkSocket
from django.conf import settings
import tempfile
import os
import time
import re
import base64
import hashlib
import uuid

def scan_file(file):
    """
    Scan a file using ClamAV.
    Returns (is_clean, message)
    """
    try:
        # Initialize ClamAV client
        cd = ClamdNetworkSocket(
            host=settings.CLAMD_HOST,  # This is the service name in docker-compose
            port=int(settings.CLAMD_PORT)
        )
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            for chunk in file.chunks():
                tmp_file.write(chunk)
            tmp_file.flush()
            
            try:
                # Scan the temporary file
                scan_result = cd.scan(tmp_file.name)
                file_scan_result = scan_result.get(tmp_file.name)
                
                if file_scan_result is None:
                    return True, "File is clean"
                elif file_scan_result[0] == "OK":
                    return True, "File is clean"
                else:
                    return False, f"Malware detected: {file_scan_result[1]}"
            finally:
                # Clean up the temporary file
                os.unlink(tmp_file.name)
                
    except Exception as e:
        return False, f"Error scanning file: {str(e)}"


def save_and_copy_file(uploaded_file, property_id, media_type):
    """
    Save file to both <strikethrough>Django media directory and</strikethrough> static service directory
    Returns the relative path to the file in the static service
    """
    # Generate a random filename
    extension = os.path.splitext(uploaded_file.name)[1]
    random_filename = f"{uuid.uuid4()}{extension}"
    
    # Create directory paths
    relative_path = f'properties/{property_id}'
    static_media_path = os.path.join(settings.STATIC_MEDIA_ROOT, relative_path)
    
    # Create directories if they don't exist
    os.makedirs(static_media_path, exist_ok=True)
   
    # Save to static media directory 
    static_file_path = os.path.join(static_media_path, random_filename)
    with open(static_file_path, 'wb+') as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)

    
    # Return the relative path for database storage
    # print('media_type', media_type)
    # print('static_media_path', static_media_path)
    # print('relative_path', relative_path)
    # print('random_filename', random_filename)
    # print('static_file_path', static_file_path)

    return f'{relative_path}/{random_filename}'

def generate_secure_url(file_path, expires_in=3600):
    """
    Generate a secure URL with MD5 hash and expiration time
    :param file_path: Path to the file relative to MEDIA_ROOT
    :param expires_in: Number of seconds until the URL expires
    :return: Secure URL with MD5 hash and expiration
    """
    # Get the secret key from environment
    secret_key = settings.NGINX_SECURE_LINK_SECRET
    
    # Calculate expiration timestamp
    expires = int(time.time()) + expires_in
    
    # Clean and encode the file path
    # Remove any leading slashes, 'media/' prefix, and 'uploads/' prefix
    clean_path = re.sub(r'^/*(?:media/|uploads/)*', '', file_path.lstrip('/'))
    
    # Create the string to hash following NGINX's secure_link_md5 format
    # NGINX config: secure_link_md5 "$arg_expires|$uri|$secret_key";
    uri = f"/media-secure/{clean_path}"
    
    # Important: Use | as separator in the string to hash
    string_to_hash = f"{expires}|{uri}|{secret_key}"
    
    # print(f"Debug - File path: {file_path}")
    # print(f"Debug - Clean path: {clean_path}")
    # print(f"Debug - URI for hash: {uri}")
    # print(f"Debug - Expires: {expires}")
    # print(f"Debug - String to hash: {string_to_hash}")
    
    # Calculate MD5 hash and encode in base64 for nginx
    md5_hash = base64.urlsafe_b64encode(hashlib.md5(string_to_hash.encode('utf-8')).digest()).decode('utf-8')
    # Remove padding = characters as nginx doesn't expect them
    md5_hash = md5_hash.rstrip('=')
    
    # print(f"Debug - MD5 hash: {md5_hash}")
    
    # Construct and return the secure URL
    if settings.DEBUG_HESTAMI_AI:
        url = f"http://localhost:8090{uri}?md5={md5_hash}&expires={expires}"
        #print(f"Debug - generate_secure_url: {url}")
    else:
        url = f"https://static.hestami-ai.com{uri}?md5={md5_hash}&expires={expires}"
        #print(f"Debug - generate_secure_url: {url}")
    
    return url