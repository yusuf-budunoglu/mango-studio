// Yalnızca yerel dışa aktarma için: dosya izleme kapalı (başka bir düzenleme sayfayı yeniden yükleyip çıktıyı kesmesin).
import base from './vite.config'
export default { ...base, server: { ...(base as { server?: object }).server, watch: { ignored: ['**/*'] }, hmr: false } }
