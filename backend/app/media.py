import hashlib
import io
import uuid
from pathlib import Path
import boto3
import httpx
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException, UploadFile
from .config import settings

Image.MAX_IMAGE_PIXELS = 20_000_000


async def clean_image(file: UploadFile):
    data = await file.read(settings().max_upload_bytes + 1)
    if len(data) > settings().max_upload_bytes:
        raise HTTPException(413, 'Photo must be 5 MB or smaller.')
    try:
        with Image.open(io.BytesIO(data)) as original:
            if original.format not in {'JPEG', 'PNG', 'WEBP'}:
                raise ValueError('Unsupported image')
            if original.width * original.height > Image.MAX_IMAGE_PIXELS:
                raise ValueError('Image exceeds pixel limit')
            original.load()
            photo = ImageOps.exif_transpose(original).convert('RGB')
            photo.thumbnail((1600, 1600))
            small = photo.resize((9, 8)).convert('L')
            pixels = list(small.get_flattened_data())
            bits = ''.join('1' if pixels[y * 9 + x] > pixels[y * 9 + x + 1] else '0' for y in range(8) for x in range(8))
            visual = f'{int(bits, 2):016x}'
            output = io.BytesIO()
            photo.save(output, 'JPEG', quality=85)
            clean = output.getvalue()
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, 'Upload a valid JPEG, PNG, or WebP photo, up to 20 megapixels.')
    return clean, hashlib.sha256(clean).hexdigest(), visual


def client():
    s = settings()
    return boto3.client('s3', endpoint_url=s.storage_endpoint or None, region_name=s.storage_region,
                        aws_access_key_id=s.storage_access_key, aws_secret_access_key=s.storage_secret_key)


def put_image(data):
    key = f'reports/{uuid.uuid4().hex}.jpg'
    s = settings()
    if s.supabase_url and s.supabase_key and s.storage_bucket:
        try:
            response = httpx.post(f'{s.supabase_url}/storage/v1/object/{s.storage_bucket}/{key}', content=data,
                headers=supabase_headers() | {'Content-Type':'image/jpeg'}, timeout=20)
            response.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(503, 'Photo storage is temporarily unavailable. Try again later.')
    elif s.storage_bucket:
        try:
            client().put_object(Bucket=s.storage_bucket, Key=key, Body=data, ContentType='image/jpeg', CacheControl='private, max-age=300')
        except Exception:
            raise HTTPException(503, 'Photo storage is temporarily unavailable. Try again later.')
    elif s.environment in {'development', 'test'}:
        path = Path('uploads') / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    else:
        raise HTTPException(503, 'Private cloud image storage has not been configured.')
    return key


def image_url(key):
    s = settings()
    if s.supabase_url and s.supabase_key and s.storage_bucket:
        try:
            response = httpx.post(f'{s.supabase_url}/storage/v1/object/sign/{s.storage_bucket}/{key}',
                headers=supabase_headers(), json={'expiresIn':300}, timeout=10)
            response.raise_for_status()
            return s.supabase_url + '/storage/v1' + response.json()['signedURL']
        except (httpx.HTTPError, KeyError):
            raise HTTPException(503, 'Photo storage is temporarily unavailable. Try again later.')
    if settings().storage_bucket:
        return client().generate_presigned_url('get_object', Params={'Bucket': settings().storage_bucket, 'Key': key}, ExpiresIn=300)
    return f'/dev-media/{key}'


def supabase_headers():
    key = settings().supabase_key
    headers = {'apikey': key}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = f'Bearer {key}'
    return headers
