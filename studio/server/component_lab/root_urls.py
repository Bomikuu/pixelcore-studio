from django.urls import include, path
urlpatterns = [path('api/studio/', include('component_lab.urls')), path('', include('website_builder.demo_urls'))]
