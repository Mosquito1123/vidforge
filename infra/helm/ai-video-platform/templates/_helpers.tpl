{{/*
Common template helpers.
*/}}
{{- define "ai-video.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ai-video.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "ai-video.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "ai-video.labels" -}}
app.kubernetes.io/name: {{ include "ai-video.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "ai-video.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ai-video.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "ai-video.configMapName" -}}
{{ include "ai-video.fullname" . }}-config
{{- end -}}

{{- define "ai-video.secretName" -}}
{{ include "ai-video.fullname" . }}-secrets
{{- end -}}
