import copy
from datetime import timedelta
from django.test import TestCase,Client,override_settings
from django.core.exceptions import ValidationError,PermissionDenied
from django.utils import timezone
from website_builder.models import Website,ReviewShare
from website_builder.services.revisions import save_draft,publish,create_review,active_share,VersionConflict
from website_builder.services.reviews import add_comment,threads_payload

COLORS={"background":"#ffffff","surface":"#f4f6f8","text":"#19252e","muted":"#53616d","primary":"#125b50","onPrimary":"#ffffff","accent":"#ba5a30","border":"#d8dfe4"}
def document():
    return {"schemaVersion":1,"type":"page","id":"page","mode":"fixed","title":"Review","theme":{"colors":COLORS.copy(),"bodyFont":"Manrope","headingFont":"Georgia","baseSize":16,"scale":1.25,"radius":4},"props":{},"style":{},"responsive":{},"children":[{"type":"text","id":"intro","props":{"text":"Original"},"style":{},"responsive":{},"children":[]}]}
class ReviewTests(TestCase):
    def setUp(self):
        self.site=Website.objects.create(tenant="local-demo",key="example")
        self.site=save_draft(self.site.id,document(),0)
        self.data={"assets":{},"identity":{"name":"Example"}}
    def review(self,**kwargs):
        return create_review(self.site.id,self.site.version,self.data,**kwargs)
    def test_draft_does_not_unpublish(self):
        publish(self.site.id,1)
        changed=document();changed["children"][0]["props"]["text"]="Draft only"
        updated=save_draft(self.site.id,changed,1)
        self.assertEqual(updated.published.document["children"][0]["props"]["text"],"Original")
        self.assertEqual(updated.draft.number,2)
    def test_old_share_survives_new_revision_and_snapshot_stays_fixed(self):
        share,token=self.review();self.data["identity"]["name"]="Changed outside"
        changed=document();changed["children"][0]["props"]["text"]="Later"
        save_draft(self.site.id,changed,1)
        opened=active_share(token=token)
        self.assertEqual(opened.revision.document["children"][0]["props"]["text"],"Original")
        self.assertEqual(opened.data_snapshot["identity"]["name"],"Example")
    def test_revisions_are_immutable(self):
        revision=self.site.draft;revision.document={}
        with self.assertRaises(ValueError):revision.save()
    def test_version_conflict_does_not_create_a_revision(self):
        with self.assertRaises(VersionConflict):save_draft(self.site.id,document(),0)
        self.assertEqual(self.site.revisions.count(),1)
    def test_tokens_are_hashed_expire_and_can_be_revoked(self):
        share,token=self.review();self.assertNotEqual(share.secret_hash,token)
        share.expires_at=timezone.now()-timedelta(seconds=1);share.save()
        with self.assertRaises(PermissionDenied):active_share(token=token)
        share.expires_at=timezone.now()+timedelta(days=1);share.revoked_at=timezone.now();share.save()
        with self.assertRaises(PermissionDenied):active_share(token=token)
    def test_named_guest_comment_and_reply(self):
        share,_=self.review();thread=add_comment(share.id,display_name="Guest",body="<script>Untrusted text</script>",anchor={"nodeId":"intro"})
        add_comment(share.id,display_name="Reviewer",body="Reply",thread_id=thread.id)
        payload=threads_payload(share)
        self.assertEqual(len(payload[0]["comments"]),2)
        self.assertEqual(payload[0]["comments"][0]["body"],"<script>Untrusted text</script>")
    def test_view_only_share_rejects_comments(self):
        share,_=self.review(can_comment=False)
        with self.assertRaises(PermissionDenied):add_comment(share.id,display_name="Guest",body="No",anchor={"nodeId":"intro"})
    def test_cross_share_reply_and_unknown_anchor_are_rejected(self):
        a,_=self.review();b,_=self.review();thread=add_comment(a.id,display_name="A",body="A",anchor={"nodeId":"intro"})
        with self.assertRaises(PermissionDenied):add_comment(b.id,display_name="B",body="B",thread_id=thread.id)
        with self.assertRaises(ValidationError):add_comment(a.id,display_name="A",body="A",anchor={"nodeId":"missing"})
    def test_invalid_position_and_oversized_comment_are_rejected(self):
        share,_=self.review()
        with self.assertRaises(ValidationError):add_comment(share.id,display_name="A",body="A",anchor={"nodeId":"intro","x":float('nan')})
        with self.assertRaises(ValidationError):add_comment(share.id,display_name="A",body="X"*4001,anchor={"nodeId":"intro"})
    def test_document_rejects_executable_settings_and_duplicate_ids(self):
        changed=document();changed["children"][0]["props"]["html"]="<script>"
        with self.assertRaises(ValidationError):save_draft(self.site.id,changed,1)
        changed=document();changed["children"].append(copy.deepcopy(changed["children"][0]))
        with self.assertRaises(ValidationError):save_draft(self.site.id,changed,1)
    def test_guest_cannot_open_workspace_and_cookie_is_httponly(self):
        client=Client();site=Website.objects.create(tenant="another-tenant",key="private")
        self.assertEqual(client.get(f"/api/website-builder/sites/{site.id}/").status_code,401)
        share,token=self.review();res=client.post('/api/website-builder/reviews/exchange/',data={"token":token},content_type='application/json')
        self.assertEqual(res.status_code,200)
        self.assertTrue(any(cookie['httponly'] for cookie in res.cookies.values()))
        self.assertEqual(res['Cache-Control'],'no-store, private')
    @override_settings(WEBSITE_BUILDER_REVIEW_DATA=lambda request,share: (_ for _ in ()).throw(PermissionDenied("Withdrawn")))
    def test_review_rechecks_host_access(self):
        _,token=self.review();res=self.client.post('/api/website-builder/reviews/exchange/',data={"token":token},content_type='application/json');self.assertEqual(res.status_code,403)

    def test_csrf_is_required_for_guest_exchange_and_comment(self):
        client=Client(enforce_csrf_checks=True)
        share,token=self.review()
        path='/api/website-builder/reviews/exchange/'
        self.assertEqual(client.post(path,data={'token':token},content_type='application/json').status_code,403)
        client.get('/api/website-builder/csrf/')
        csrf=client.cookies['csrftoken'].value
        opened=client.post(path,data={'token':token},content_type='application/json',HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(opened.status_code,200)
        comments=f'/api/website-builder/reviews/{share.id}/comments/'
        self.assertEqual(client.post(comments,data={'name':'Guest','body':'Review','anchor':{'nodeId':'intro'}},content_type='application/json').status_code,403)
        self.assertEqual(client.post(comments,data={'name':'Guest','body':'Review','anchor':{'nodeId':'intro'}},content_type='application/json',HTTP_X_CSRFTOKEN=csrf).status_code,200)

    def test_two_review_sessions_can_coexist_and_refresh(self):
        client=Client()
        a,ta=self.review();b,tb=self.review()
        for token in [ta,tb]:
            self.assertEqual(client.post('/api/website-builder/reviews/exchange/',data={'token':token},content_type='application/json').status_code,200)
        for share in [a,b]:
            self.assertEqual(client.get(f'/api/website-builder/reviews/{share.id}/').status_code,200)
        a.revoked_at=timezone.now();a.save()
        self.assertEqual(client.get(f'/api/website-builder/reviews/{a.id}/comments/').status_code,403)

    def test_invalid_theme_injection_is_rejected(self):
        changed=document();changed['theme']['colors']['bad;']='#ffffff'
        with self.assertRaises(ValidationError):save_draft(self.site.id,changed,1)
        changed=document();changed['children'][0]['style']={'background':{'type':'solid','color':'red;display:none'}}
        with self.assertRaises(ValidationError):save_draft(self.site.id,changed,1)

    def test_element_appearance_roundtrips_drafts_and_published_revisions(self):
        changed = document()
        style = {"backgroundColor": "transparent", "color": "primary", "borderWidth": 1, "borderStyle": "solid", "borderColor": "primary", "borderRadius": 200, "boxShadow": "none", "overflow": "hidden"}
        changed['children'][0]['style'] = style.copy()
        changed['children'][0]['responsive'] = {"tablet": {"boxShadow": "soft", "backgroundColor": "surface"}, "phone": {"borderWidth": 0, "boxShadow": "lifted"}}
        updated = save_draft(self.site.id, changed, 1)
        live = publish(updated.id, updated.version)
        self.assertEqual(live.published.document['children'][0]['style'], style)
        self.assertEqual(live.published.document['children'][0]['responsive'], changed['children'][0]['responsive'])

    def test_custom_appearance_rejects_injection_invalid_types_and_out_of_bounds_values(self):
        from website_builder.validation import validate_styles
        for style in [{"borderWidth": -1}, {"borderWidth": 13}, {"borderWidth": True}, {"borderColor": "red;display:none"}, {"boxShadow": "url(javascript:alert(1))"}, {"boxShadow": {}}, {"borderStyle": "double"}, {"overflow": "scroll"}, {"color": "transparent"}]:
            with self.subTest(style=style), self.assertRaises(ValidationError):
                validate_styles(style)


@override_settings(WEBSITE_BUILDER_AUTHORIZE=lambda request, site, action: site.tenant == 'local-demo')
class TemplateTests(TestCase):
    def setUp(self):
        self.site = Website.objects.create(tenant='local-demo', key='templates')
        self.path = f'/api/website-builder/sites/{self.site.id}/templates/'

    def test_template_roundtrip_is_shared_within_tenant_without_editing_a_page(self):
        from website_builder.models import SavedTemplate
        source = document()
        source['context'] = {'version': 1, 'purpose': 'landing', 'sourceId': 'source-page', 'setupComplete': 1}
        source['children'][0]['style']['fontFamily'] = 'Arial'
        response = self.client.post(self.path, data={'name': '  Campaign  ', 'description': 'Reusable layout', 'document': source, 'tenant': 'forged'}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        saved = response.json()['template']
        self.assertEqual(saved['name'], 'Campaign')
        self.assertNotIn('context', saved['document'])
        self.assertNotIn('fontFamily', saved['document']['children'][0]['style'])
        self.assertEqual(SavedTemplate.objects.get().tenant, 'local-demo')
        sibling = Website.objects.create(tenant='local-demo', key='other-page')
        response = self.client.get(f'/api/website-builder/sites/{sibling.id}/templates/')
        self.assertEqual(response.json()['templates'][0]['id'], saved['id'])
        self.site.refresh_from_db()
        self.assertEqual(self.site.version, 0)
        self.assertIsNone(self.site.draft_id)

    def test_cross_tenant_and_review_guests_cannot_read_or_create_templates(self):
        from website_builder.models import SavedTemplate
        SavedTemplate.objects.create(tenant='another-tenant', name='Private', document=document())
        self.assertEqual(self.client.get(self.path).json()['templates'], [])
        private = Website.objects.create(tenant='another-tenant', key='other')
        path = f'/api/website-builder/sites/{private.id}/templates/'
        self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.post(path, data={'name': 'Forbidden', 'document': document()}, content_type='application/json').status_code, 401)
        with override_settings(WEBSITE_BUILDER_AUTHORIZE=lambda request, site, action: False):
            self.assertEqual(self.client.get(self.path).status_code, 401)
            self.assertEqual(self.client.post(self.path, data={'name': 'Forbidden', 'document': document()}, content_type='application/json').status_code, 401)

    def test_invalid_template_is_rejected_without_creating_library_records(self):
        from website_builder.models import SavedTemplate
        for name in ['', 'x' * 101]:
            self.assertEqual(self.client.post(self.path, data={'name': name, 'document': document()}, content_type='application/json').status_code, 400)
        self.assertEqual(self.client.post(self.path, data={'name': 'Invalid', 'description': 'x' * 301, 'document': document()}, content_type='application/json').status_code, 400)
        for extra in [{'dataSnapshot': {'guest': 'private'}}, {'script': 'untrusted'}]:
            invalid = {**document(), **extra}
            self.assertEqual(self.client.post(self.path, data={'name': 'Invalid', 'document': invalid}, content_type='application/json').status_code, 400)
        duplicate = document(); duplicate['children'].append(copy.deepcopy(duplicate['children'][0]))
        self.assertEqual(self.client.post(self.path, data={'name': 'Invalid', 'document': duplicate}, content_type='application/json').status_code, 400)
        self.assertEqual(SavedTemplate.objects.count(), 0)

    def test_template_limit_and_csrf_are_enforced(self):
        from website_builder.models import SavedTemplate
        SavedTemplate.objects.bulk_create([SavedTemplate(tenant='local-demo', name=f'Template {i}', document=document()) for i in range(100)])
        response = self.client.post(self.path, data={'name': 'Overflow', 'document': document()}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SavedTemplate.objects.count(), 100)
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.post(self.path, data={'name': 'No CSRF', 'document': document()}, content_type='application/json').status_code, 403)

    def test_draft_font_normalization_keeps_previous_revisions_and_input_unchanged(self):
        source = document()
        source['style']['fontFamily'] = 'Arial'
        source['children'][0]['responsive']['phone'] = {'fontFamily': 'Verdana', 'fontSize': 24}
        site = save_draft(self.site.id, source, 0)
        self.assertNotIn('fontFamily', site.draft.document['style'])
        self.assertEqual(site.draft.document['children'][0]['responsive']['phone'], {'fontSize': 24})
        self.assertEqual(source['style']['fontFamily'], 'Arial')
        first = site.draft
        second = document(); second['theme']['headingFont'] = 'Cormorant Garamond'
        save_draft(site.id, second, 1)
        first.refresh_from_db()
        self.assertEqual(first.document['theme']['headingFont'], 'Georgia')
