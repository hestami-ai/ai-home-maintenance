# Migration to change vector dimensions from 1536 to 1024 for Ollama qwen3-embedding

from django.db import migrations
import pgvector.django.vector


class Migration(migrations.Migration):
    atomic = False  # Required for DROP/CREATE INDEX CONCURRENTLY

    dependencies = [
        ('services', '0025_add_gin_and_vector_indexes'),
    ]

    operations = [
        # Drop existing HNSW index
        migrations.RunSQL(
            sql="""
                DROP INDEX CONCURRENTLY IF EXISTS services_serviceprovider_description_embedding_hnsw;
            """,
            reverse_sql="""
                -- Reverse: recreate with old dimensions (1536)
                CREATE INDEX CONCURRENTLY IF NOT EXISTS services_serviceprovider_description_embedding_hnsw 
                ON services_serviceprovider 
                USING hnsw (description_embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """
        ),
        
        # Alter field to new dimensions
        migrations.AlterField(
            model_name='serviceprovider',
            name='description_embedding',
            field=pgvector.django.vector.VectorField(
                blank=True,
                dimensions=1024,
                help_text='Vector embedding of business description for semantic search',
                null=True
            ),
        ),
        
        # Recreate HNSW index with new dimensions
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS services_serviceprovider_description_embedding_hnsw 
                ON services_serviceprovider 
                USING hnsw (description_embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """,
            reverse_sql="""
                DROP INDEX CONCURRENTLY IF EXISTS services_serviceprovider_description_embedding_hnsw;
            """
        ),
    ]
