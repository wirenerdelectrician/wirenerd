/* WireNerd shared notification bell — include on any page with:
   <script defer src="/wn-notify.js"></script>
   It injects a 🔔 into the page header (only when signed in) and shows reply notifications. */
(function () {
  if (window.__wnNotifyLoaded) return;
  if (document.getElementById('wnBell')) return;   // page already has its own bell (forum.html)
  window.__wnNotifyLoaded = true;

  // Skip entirely for logged-out visitors (don't even load the SDK)
  try {
    var hasSession = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('-auth-token') > -1) { hasSession = true; break; }
    }
    if (!hasSession) return;
  } catch (e) { return; }

  var SB_URL = "https://ntlfuexiilxydnpuqhhv.supabase.co";
  var SB_KEY = "sb_publishable_OWZrMSaAkonwYjfTrYpuyg_xn_Gy-eG";

  function esc(s){return (s||"").replace(/[&<>"]/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c];});}
  function ago(ts){var d=(Date.now()-new Date(ts).getTime())/1000;
    if(d<60)return"just now";if(d<3600)return Math.floor(d/60)+"m ago";if(d<86400)return Math.floor(d/3600)+"h ago";
    if(d<604800)return Math.floor(d/86400)+"d ago";return new Date(ts).toLocaleDateString();}

  function injectStyle(){
    if(document.getElementById('wn-notify-style'))return;
    var st=document.createElement('style'); st.id='wn-notify-style';
    st.textContent =
    '.wn-bell{position:relative;margin-left:22px;background:none;border:0;cursor:pointer;font-size:18px;line-height:1;padding:2px;color:#ece9e2}'+
    '.wn-badge{position:absolute;top:-6px;right:-8px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#E24B4A;color:#fff;font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;line-height:16px}'+
    '.wn-notif{position:fixed;top:60px;right:18px;width:330px;max-width:calc(100vw - 24px);max-height:72vh;overflow:auto;background:#fff;border:1px solid #d9d6cc;border-radius:14px;box-shadow:0 16px 50px rgba(0,0,0,.28);z-index:9999;font-family:"Saira",system-ui,sans-serif}'+
    '.wn-notif-h{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6c6a62;padding:14px 16px 8px}'+
    '.wn-notif-item{display:block;padding:12px 16px;border-top:1px solid #e7e4dc;font-size:14px;color:#1b1a17;text-decoration:none;line-height:1.45}'+
    '.wn-notif-item:hover{background:#f6f5f2}'+
    '.wn-notif-item.unread{background:#fff7ec}'+
    '.wn-notif-t{color:#6c6a62}'+
    '.wn-notif-time{display:block;font-family:"JetBrains Mono",monospace;font-size:11px;color:#6c6a62;margin-top:3px}'+
    '.wn-notif-empty{padding:22px 16px;color:#6c6a62;font-size:14px;line-height:1.5}';
    document.head.appendChild(st);
  }

  function loadSupabase(cb){
    if (window.supabase && window.supabase.createClient){ cb(); return; }
    var s=document.createElement('script');
    s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload=cb; s.onerror=function(){};
    document.head.appendChild(s);
  }

  loadSupabase(function () {
    if (!(window.supabase && window.supabase.createClient)) return;
    var sb = window.supabase.createClient(SB_URL, SB_KEY);
    var nav = document.querySelector('header nav') || document.querySelector('header');
    if (!nav) return;

    sb.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (!session || !session.user) return;
      var me = session.user;
      injectStyle();

      var bell = document.createElement('button');
      bell.id = 'wnBell'; bell.className = 'wn-bell'; bell.type = 'button';
      bell.setAttribute('aria-label', 'Notifications');
      bell.innerHTML = '🔔<span id="wnBadge" class="wn-badge"></span>';
      nav.appendChild(bell);

      var panel = document.createElement('div');
      panel.id = 'wnNotifPanel'; panel.className = 'wn-notif'; panel.style.display = 'none';
      document.body.appendChild(panel);

      var notifs = [], unread = 0, open = false, subbed = false;
      function renderBadge(){var b=document.getElementById('wnBadge'); if(!b)return; if(unread>0){b.textContent=unread>9?'9+':String(unread); b.style.display='inline-flex';}else{b.style.display='none';}}
      function renderPanel(){
        if(!notifs.length){panel.innerHTML='<div class="wn-notif-empty">No notifications yet. When someone replies to one of your posts, you\'ll see it here.</div>';return;}
        var html='<div class="wn-notif-h">Notifications</div>';
        notifs.forEach(function(n){
          html+='<a class="wn-notif-item '+(n.read?'':'unread')+'" href="/forum.html#post='+n.post_id+'"><b>'+esc(n.actor_name||'Someone')+'</b> replied to your post'+(n.post_title?' <span class="wn-notif-t">"'+esc(n.post_title)+'"</span>':'')+'<span class="wn-notif-time">'+ago(n.created_at)+'</span></a>';
        });
        panel.innerHTML=html;
      }
      function load(){
        sb.from('notifications').select('id,read,created_at,actor_name,post_id,post_title').eq('user_id',me.id).order('created_at',{ascending:false}).limit(30).then(function(r){
          notifs=(r&&r.data)||[]; unread=notifs.filter(function(n){return !n.read;}).length; renderBadge(); if(open)renderPanel();
        });
      }
      function markRead(){
        if(!unread)return; unread=0; renderBadge(); notifs.forEach(function(n){n.read=true;});
        sb.from('notifications').update({read:true}).eq('user_id',me.id).eq('read',false).then(function(){},function(){});
      }
      function openP(){open=true; panel.style.display='block'; renderPanel(); markRead();}
      function closeP(){open=false; panel.style.display='none';}
      bell.onclick=function(e){e.stopPropagation(); open?closeP():openP();};
      document.addEventListener('click',function(e){ if(open && !panel.contains(e.target) && e.target!==bell) closeP(); });

      load();
      if(!subbed){ subbed=true;
        try{ sb.channel('wn-notify-'+me.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+me.id},function(p){notifs.unshift(p.new); unread++; renderBadge(); if(open)renderPanel();}).subscribe(); }catch(e){}
        setInterval(load, 45000);
      }
    });
  });
})();
