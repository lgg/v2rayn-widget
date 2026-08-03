#[test]
fn destructive_app_actions_are_routed_through_draft_guards() {
    let main_source = include_str!("../src/main.rs");
    let action_source = include_str!("../src/app_actions.rs");
    let frontend_api = include_str!("../../frontend/src/lib/api.ts");

    assert!(main_source.contains(
        "\"exit\" => app_actions::request_exit_app_from_native(app.clone())"
    ));
    assert!(main_source.contains("app_actions::request_relaunch_widget_as_admin"));
    assert!(main_source.contains("app_actions::request_exit_app"));
    assert!(!main_source.contains("commands::relaunch_widget_as_admin,"));
    assert!(!main_source.contains("commands::exit_app"));

    assert!(frontend_api.contains("invoke(\"request_relaunch_widget_as_admin\")"));
    assert!(frontend_api.contains("invoke(\"request_exit_app\")"));
    assert!(!frontend_api.contains("invoke(\"relaunch_widget_as_admin\")"));
    assert!(!frontend_api.contains("invoke(\"exit_app\")"));

    assert!(action_source.contains("settings-close-requested"));
    assert!(action_source.contains("happ-setup-close-requested"));
    assert!(action_source.contains("commands::relaunch_widget_as_admin(app).await"));
    assert!(action_source.contains("commands::exit_app(app).await"));
}
