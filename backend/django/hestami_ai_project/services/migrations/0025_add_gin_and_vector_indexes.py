# Generated manually for PostGIS and pgvector indexes

from django.db import migrations
from django.contrib.postgres.operations import AddIndexConcurrently


class Migration(migrations.Migration):
    atomic = False  # Required for CREATE INDEX CONCURRENTLY

    dependencies = [
        ('services', '0024_serviceprovider_address_and_more'),
    ]

    operations = [
        # Create GIN index for JSONB merged_data field
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS services_serviceprovider_merged_data_gin 
                ON services_serviceprovider USING GIN (merged_data jsonb_path_ops);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS services_serviceprovider_merged_data_gin;
            """
        ),
        
        # Create HNSW index for vector similarity search
        # HNSW is more efficient than IVFFlat for most use cases
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS services_serviceprovider_description_embedding_hnsw 
                ON services_serviceprovider 
                USING hnsw (description_embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS services_serviceprovider_description_embedding_hnsw;
            """
        ),
    ]
