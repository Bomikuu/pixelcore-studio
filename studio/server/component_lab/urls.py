from django.urls import path
from . import views, runtime, starter, platforms, workspace, profiles
urlpatterns = [
    path('profile/',profiles.profile),path('profile/avatar/',profiles.avatar),path('profile/avatar/<str:key>/',profiles.image),path('profile/password/',profiles.password),
    path('connect/begin/',platforms.begin),path('connect/complete/',platforms.complete),
    path('workspace/',workspace.overview),path('workspace/open/',workspace.open_website),
    path('workspace/builder/<path:route>',workspace.builder),
    path('workspace/analytics/<uuid:website_id>/',workspace.analytics),
    path('session/', views.session), path('components/', views.components),
    path('components/<uuid:component_id>/', views.detail),
    path('components/<uuid:component_id>/approve/', views.approve),
    path('components/<uuid:component_id>/export/<int:number>/', views.export),
    path('catalog/<uuid:component_id>/<int:number>/', views.catalog_version), path('catalog/', views.catalog), path('starter/', starter.starter),
    path('runtime/<str:ticket>/<uuid:component_id>/<int:number>/<path:file_path>', runtime.asset),
]
