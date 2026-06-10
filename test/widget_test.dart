import 'package:flutter_test/flutter_test.dart';

import 'package:sohojtv/main.dart';

void main() {
  testWidgets('shows Sohoj TV branding', (WidgetTester tester) async {
    await tester.pumpWidget(const SohojTvApp());

    expect(find.text('Sohoj TV'), findsOneWidget);
    expect(find.text('Live channels by Butterfly Devs'), findsOneWidget);
  });
}
