from django.contrib import admin
from .models import Property, PropertyAccess, PropertyScrapedData, PermitHistory, PermitAttachment

# Register your models here.
admin.site.register(Property)
admin.site.register(PropertyAccess)
admin.site.register(PropertyScrapedData)
admin.site.register(PermitHistory)
admin.site.register(PermitAttachment)