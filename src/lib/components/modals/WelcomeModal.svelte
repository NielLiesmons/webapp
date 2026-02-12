<script lang="ts">
	/**
	 * WelcomeModal - Initial prompt for non-logged-in users trying to comment
	 *
	 * Shows a friendly message and leads to the Get Started modal.
	 */
	import Modal from '$lib/components/common/Modal.svelte';

	interface Props {
		open?: boolean;
		onGetStarted?: () => void;
		onCloseParent?: () => void;
	}

	let { open = $bindable(false), onGetStarted, onCloseParent }: Props = $props();

	function handleGetStarted() {
		open = false;
		// Close parent modal first if callback provided
		onCloseParent?.();
		// Small delay to allow parent modal to close first
		setTimeout(() => {
			onGetStarted?.();
		}, 100);
	}
</script>

<Modal bind:open ariaLabel="Welcome to Zapstore" zIndex={105}>
	<div class="welcome-modal-content">
		<div class="welcome-header">
			<h2 class="welcome-title text-display text-4xl">Welcome to Zapstore</h2>
			<p class="welcome-message">Commenting here requires adding a profile</p>
		</div>
		<button type="button" class="btn-primary-large get-started-btn" onclick={handleGetStarted}>
			Get Started
		</button>
	</div>
</Modal>

<style>
	.welcome-modal-content {
		padding: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 32px;
	}

	.welcome-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
	}

	.welcome-title {
		color: hsl(var(--foreground));
		margin: 0;
	}

	.welcome-message {
		font-size: 1rem;
		color: hsl(var(--white66));
		margin: 0;
		max-width: 400px;
		line-height: 1.5;
	}

	.get-started-btn {
		width: 100%;
		max-width: 320px;
	}

	@media (min-width: 768px) {
		.welcome-modal-content {
			padding: 32px;
		}
	}
</style>
