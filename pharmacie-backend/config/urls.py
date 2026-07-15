"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .health import healthz

urlpatterns = [
    path("healthz/", healthz, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # 🔢 VERSIONING API (voir docs/API_VERSIONING.md pour la stratégie complète) :
    # - "api/v1/" est le préfixe CANONIQUE à utiliser pour tout nouveau code (frontend,
    #   mobile, intégrations tierces). C'est la même urlconf que "api/" ci-dessous --
    #   littéralement les mêmes vues, zéro différence de comportement aujourd'hui.
    # - "api/" (sans version) reste monté pour ne PAS casser le frontend Next.js existant,
    #   qui appelle encore ce préfixe partout -- migration progressive, pas de big-bang.
    # Le jour où un changement cassant est nécessaire sur une route : on le fait dans
    # core/urls_v2.py + core/api.py (nouvelles fonctions), monté sous "api/v2/", et "api/v1/"
    # continue de servir l'ancien comportement sans y toucher. On ne casse jamais v1 en place.
    path("api/v1/", include("core.urls", namespace="core_v1")),
    path("api/", include("core.urls", namespace="core_legacy")),

    path("accounts/", include("django.contrib.auth.urls")), 
   
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)